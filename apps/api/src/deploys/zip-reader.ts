import { isRelativePath, type UploadLimits } from '@croffledev/play-protocol';
import { BadRequestException } from '@nestjs/common';
import yauzl from 'yauzl';

export interface ZipFile {
  /** Normalized path inside the build (`index.html`, `assets/a.js`). */
  path: string;
  body: Uint8Array;
}

const SYMLINK = 0o120000;

/**
 * Reads a game build zip into memory, refusing anything a game site cannot contain: paths that
 * leave the build (`..`, absolute, backslashes, drive letters), symbolic links, more files or
 * bytes than `limits` allow, or entries whose declared size lies. Zip parsing itself is left to
 * yauzl (never hand-rolled). A single top-level folder wrapping everything is stripped.
 */
export async function readBuildZip(zip: Uint8Array, limits: UploadLimits): Promise<ZipFile[]> {
  if (zip.byteLength > limits.maxZipBytes) {
    throw new BadRequestException(`The zip is larger than ${limits.maxZipBytes} bytes`);
  }
  const zipfile = await open(zip);
  const files: ZipFile[] = [];
  let total = 0;
  try {
    for await (const entry of entries(zipfile)) {
      const name = entry.fileName;
      if (name.endsWith('/')) {
        continue; // directory
      }
      if ((entry.externalFileAttributes >>> 16) & SYMLINK && isSymlink(entry)) {
        throw new BadRequestException(`'${name}' is a symbolic link`);
      }
      checkPath(name, limits);
      if (entry.uncompressedSize > limits.maxFileBytes) {
        throw new BadRequestException(`'${name}' is larger than ${limits.maxFileBytes} bytes`);
      }
      total += entry.uncompressedSize;
      if (total > limits.maxTotalBytes) {
        throw new BadRequestException(`The build is larger than ${limits.maxTotalBytes} bytes`);
      }
      if (files.length >= limits.maxFiles) {
        throw new BadRequestException(`The build has more than ${limits.maxFiles} files`);
      }
      files.push({ path: name, body: await read(zipfile, entry) });
    }
  } finally {
    zipfile.close();
  }
  if (files.length === 0) {
    throw new BadRequestException('The zip is empty');
  }
  return stripWrapper(files);
}

function checkPath(name: string, limits: UploadLimits): void {
  if (name.length > limits.maxPathLength) {
    throw new BadRequestException(`'${name.slice(0, 40)}…' is longer than ${limits.maxPathLength}`);
  }
  if (
    name.includes('\0') ||
    /^[A-Za-z]:/.test(name) ||
    !isRelativePath(name) ||
    name.split('/').some((seg) => seg === '.' || seg === '..')
  ) {
    throw new BadRequestException(`'${name}' is not a path inside the build`);
  }
}

function isSymlink(entry: yauzl.Entry): boolean {
  return ((entry.externalFileAttributes >>> 16) & 0o170000) === SYMLINK;
}

/** `dist/index.html, dist/a.js` → `index.html, a.js` when every file shares one top folder. */
function stripWrapper(files: ZipFile[]): ZipFile[] {
  const first = files[0]?.path.split('/')[0];
  if (!first || !files.every((f) => f.path.startsWith(`${first}/`))) {
    return files;
  }
  return files.map((f) => ({ ...f, path: f.path.slice(first.length + 1) }));
}

function open(zip: Uint8Array): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      Buffer.from(zip.buffer, zip.byteOffset, zip.byteLength),
      { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
      (err, zipfile) => (err ? reject(invalid(err)) : resolve(zipfile)),
    );
  });
}

async function* entries(zipfile: yauzl.ZipFile): AsyncGenerator<yauzl.Entry> {
  while (true) {
    const entry = await new Promise<yauzl.Entry | null>((resolve, reject) => {
      zipfile.once('entry', (e: yauzl.Entry) => {
        zipfile.removeListener('end', onEnd);
        zipfile.removeListener('error', onError);
        resolve(e);
      });
      const onEnd = () => resolve(null);
      const onError = (err: Error) => reject(invalid(err));
      zipfile.once('end', onEnd);
      zipfile.once('error', onError);
      zipfile.readEntry();
    });
    if (!entry) {
      return;
    }
    yield entry;
  }
}

function read(zipfile: yauzl.ZipFile, entry: yauzl.Entry): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, stream) => {
      if (err) {
        reject(invalid(err));
        return;
      }
      const chunks: Buffer[] = [];
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('error', (e: Error) => reject(invalid(e)));
      stream.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
    });
  });
}

function invalid(err: Error): BadRequestException {
  return new BadRequestException(`Invalid zip: ${err.message}`);
}
