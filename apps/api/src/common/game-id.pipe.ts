import { isValidGameId } from '@croffledev/play-protocol';
import { NotFoundException, type PipeTransform } from '@nestjs/common';

/**
 * `:id` route parameters must be valid, unreserved game ids. Anything else cannot name a game,
 * so it is a 404 rather than a validation error.
 */
export class GameIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isValidGameId(value)) {
      throw new NotFoundException(`Game '${value}' not found`);
    }
    return value;
  }
}
