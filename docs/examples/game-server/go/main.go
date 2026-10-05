// Minimal authoritative game server for Croffle Play (Tier 2) in Go: verifies players with the
// platform's game tokens (JWKS) and owns the game state (a shared counter).
//
// Environment (set by the platform's compose fragment):
//
//	GAME_ID, PORT, PROTOCOL_VERSION, PLATFORM_JWKS_URL, TOKEN_ISSUER, TOKEN_AUDIENCE
//	ALLOWED_ORIGIN (default https://<GAME_ID>.play.croffle-play.link)
package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/coder/websocket"
	"github.com/golang-jwt/jwt/v5"
)

type player struct {
	UserID   string `json:"userId"`
	Nickname string `json:"nickname"`
}

type message struct {
	T     string `json:"t"`
	Token string `json:"token,omitempty"`
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	gameID := os.Getenv("GAME_ID")
	protocol := getenv("PROTOCOL_VERSION", "1.0.0")
	allowedOrigin := getenv("ALLOWED_ORIGIN", "https://"+gameID+".play.croffle-play.link")

	jwks, err := keyfunc.NewDefaultCtx(context.Background(), []string{os.Getenv("PLATFORM_JWKS_URL")})
	if err != nil {
		log.Fatalf("jwks: %v", err)
	}
	// Signature, issuer, audience (game:<id>), and expiry.
	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{"ES256"}),
		jwt.WithIssuer(os.Getenv("TOKEN_ISSUER")),
		jwt.WithAudience(os.Getenv("TOKEN_AUDIENCE")),
		jwt.WithExpirationRequired(),
	)
	verify := func(token string) (*player, bool) {
		claims := jwt.MapClaims{}
		if _, err := parser.ParseWithClaims(token, claims, jwks.Keyfunc); err != nil {
			return nil, false
		}
		sub, _ := claims.GetSubject()
		nick, _ := claims["nickname"].(string)
		return &player{UserID: sub, Nickname: nick}, sub != ""
	}

	var mu sync.Mutex
	count := 0
	conns := map[*websocket.Conn]struct{}{}
	broadcast := func(v any) {
		b, _ := json.Marshal(v)
		mu.Lock()
		defer mu.Unlock()
		for c := range conns {
			_ = c.Write(context.Background(), websocket.MessageText, b)
		}
	}

	mux := http.NewServeMux()
	// Clients check compatibility before connecting.
	mux.HandleFunc("GET /protocol", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"protocol": protocol})
	})
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Origin") != allowedOrigin {
			http.Error(w, "origin not allowed", http.StatusForbidden)
			return
		}
		c, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: []string{r.Host, allowedOrigin}})
		if err != nil {
			return
		}
		c.SetReadLimit(4096)
		defer c.CloseNow()

		// The token arrives as the first message — never in the URL.
		authCtx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		_, data, err := c.Read(authCtx)
		cancel()
		var m message
		if err != nil || json.Unmarshal(data, &m) != nil || m.T != "auth" {
			c.Close(4002, "auth required")
			return
		}
		p, ok := verify(m.Token)
		if !ok {
			c.Close(4001, "invalid token")
			return
		}
		mu.Lock()
		conns[c] = struct{}{}
		current := count
		mu.Unlock()
		defer func() {
			mu.Lock()
			delete(conns, c)
			mu.Unlock()
		}()
		welcome, _ := json.Marshal(map[string]any{"t": "welcome", "you": p, "count": current})
		_ = c.Write(r.Context(), websocket.MessageText, welcome)

		for {
			_, data, err := c.Read(r.Context())
			if err != nil {
				return
			}
			if json.Unmarshal(data, &m) == nil && m.T == "inc" {
				mu.Lock()
				count++
				current = count
				mu.Unlock()
				broadcast(map[string]any{"t": "state", "count": current, "by": p.Nickname})
			}
		}
	})

	addr := ":" + getenv("PORT", "8080")
	log.Printf("game server %s on %s (protocol %s)", gameID, addr, protocol)
	log.Fatal(http.ListenAndServe(addr, mux))
}
