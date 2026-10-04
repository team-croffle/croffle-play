import { BadRequestException, type PipeTransform } from '@nestjs/common';
import * as v from 'valibot';

/** Validates and returns a request part with a valibot schema; 400 with the issues otherwise. */
export class ValibotPipe<S extends v.GenericSchema> implements PipeTransform {
  constructor(private readonly schema: S) {}

  transform(value: unknown): v.InferOutput<S> {
    const r = v.safeParse(this.schema, value);
    if (!r.success) {
      throw new BadRequestException({
        message: 'Invalid request',
        issues: r.issues.map((i) => ({
          path: i.path?.map((p) => String(p.key)).join('.') ?? '',
          message: i.message,
        })),
      });
    }
    return r.output;
  }
}
