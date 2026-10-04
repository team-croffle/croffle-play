FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY main.go ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /server .

# The platform runs game servers read-only as uid 10001 with no capabilities.
FROM gcr.io/distroless/static:nonroot
COPY --from=build /server /server
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["/server"]
