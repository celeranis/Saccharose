import util from 'util';
import { exec, spawn } from 'child_process';
import { getGenshinDataFilePath } from '../loadenv';
import { pathToFileURL } from 'url';

const execPromise = util.promisify(exec);

/**
 * Streams the output of the command on a line-by-line basis.
 *
 * Since this is a stream, it should not run into out-of-memory issues unless there is an extremely long line in
 * the command output.
 *
 * @param command The command to execute in the bash shell.
 * @param stdoutLineStream Stream method for stdout.
 * @param stderrLineStream Stream method for stderr.
 */
export async function passthru(command: string,
                                       stdoutLineStream?: (data: string) => void,
                                       stderrLineStream?: (data: string) => void): Promise<number|Error> {
  const partial_line_buffer = {
    stdout: '',
    stderr: '',
  };

  const create_chunk_listener = (buffer_name: 'stdout' | 'stderr', stream_method: (data: string) => void) => {
    return (chunk: string) => {
      // The chunk is an arbitrary string from the output of the command, it can start at any point and end at any point.
      // However, we want to send data to the output method on a line-by-line basis.

      // Append any data left in the buffer to the start of the chunk, and then clear the buffer.
      chunk = partial_line_buffer[buffer_name] + chunk;
      partial_line_buffer[buffer_name] = '';

      if (!chunk.includes('\n')) {
        // If the chunk did not contain any new lines, that means there's no new lines to send to the output method.
        // So just save the entire chunk into the buffer and wait for the next chunk.
        partial_line_buffer[buffer_name] = chunk;
        return;
      }

      // Split the chunk into lines.
      let lines = chunk.split(/\n/g);

      // If the chunk ended with a new line, then there's no need to add to the partial line buffer.
      // But if the chunk did not end with a new line, that means the chunk ends with an incomplete line, so we do not
      // want to send that line to the output method yet.
      // Instead, we pop off that last line and put it into the partial line buffer so that the line can be completed
      // by the next chunk(s).
      if (!chunk.endsWith('\n')) {
        partial_line_buffer[buffer_name] = lines.pop();
      }

      for (let line of lines) {
        stream_method(line);
      }
    };
  };

  const flush_partial_line_buffer = () => {
    // Once the shell stream closes, send any data still left in the partial line buffers to the output methods.

    if (stdoutLineStream && partial_line_buffer.stdout)
      stdoutLineStream(partial_line_buffer.stdout);
    if (stderrLineStream && partial_line_buffer.stderr)
      stderrLineStream(partial_line_buffer.stderr);

    partial_line_buffer.stdout = '';
    partial_line_buffer.stderr = '';
  };

  return new Promise((resolve, reject) => {
    console.log('Command:', command);
    const child = spawn(command, {
      env: { PATH: process.env.SHELL_PATH },
      shell: process.env.SHELL_EXEC,
      detached: true,
    });

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    if (stdoutLineStream) {
      const listener = create_chunk_listener('stdout', stdoutLineStream);
      child.stdout.on('data', listener);
    }

    if (stderrLineStream) {
      const listener = create_chunk_listener('stderr', stderrLineStream);
      child.stderr.on('data', listener);
    }

    child.on('error', error => {
      console.error('\x1b[4m\x1b[1mshell error:\x1b[0m\n', error);
      flush_partial_line_buffer();
      reject(error);
    });

    child.on('close', exitCode => {
      flush_partial_line_buffer();
      resolve(exitCode);
    });
  });
}

/**
 * Escape a string to be used as the argument to a command.
 *
 * @param s The unescaped command argument.
 */
export function shellEscapeArg(s: string): string {
  s = s.replace(/\x00+/g, '');
  s = s.replace(/\b/g, '');

  s = s.replace(/'+/g, m => `'"${m}"'`);

  s = s.replace(/\n/g, '\\\\n');
  s = s.replace(/\r/g, '\\\\r');
  s = s.replace(/\f/g, '\\\\f');
  s = s.replace(/\t/g, '\\\\t');
  s = s.replace(/\v/g, '\\\\v');

  return `'` + s + `'`;
}

export function parseFlags(flags: string): Map<string, string> {
  if (!flags) {
    return new Map<string, string>();
  }
  let out: Map<string, string> = new Map<string, string>();
  let curr: string;
  for (let arg of flags.split(/(\s+)/g)) {
    if (arg.startsWith('--')) {
      out.set(curr = arg, '');
    } else if (arg.startsWith('-')) {
      [... arg.slice(1)].forEach(a => out.set(curr = ('-'+a), ''));
    } else if (curr) {
      out.set(curr, out.get(curr) + arg);
    }
  }
  for (let flag of out.keys()) {
    out.set(flag, out.get(flag).trim());
  }
  return out;
}

export function stringifyFlags(flags: Map<string, string>): string {
  if (!flags || !flags.size) {
    return '';
  }

  let flagsWithValues = [];
  let doubles = [];
  let singles = '';

  for (let flag of flags.keys()) {
    if (!!flags.get(flag)) {
      flagsWithValues.push(flag + ' ' + flags.get(flag));
    } else if (flag.startsWith('--')) {
      doubles.push(flag);
    } else if (flag.startsWith('-')) {
      singles += flag.slice(1);
    }
  }
  if (singles) {
    return [... flagsWithValues, ... doubles, '-' + singles].join(' ');
  } else {
    return [... flagsWithValues, ... doubles].join(' ');
  }
}

export function createGrepCommand(searchText: string, file: string, extraFlags?: string, escapeDoubleQuotes: boolean = true): string {
  let flags: Map<string, string> = parseFlags(extraFlags);

  if (/^\s*\/(.*)\/(i?)\s*$/.test(searchText)) {
    let match = /^\s*\/(.*)\/(i?)\s*$/.exec(searchText);
    let regex = match[1];
    let iFlag = match[2];
    flags.set('-P', '');
    if (iFlag) {
      flags.set('-i', '');
    }
    searchText = regex;
  }

  if (escapeDoubleQuotes && file.endsWith('.json')) {
    searchText = searchText.replace(/"/g, `\\"`); // double quotes, assuming searching within a JSON string value
  }

  searchText = shellEscapeArg(searchText);

  let hasRegexFlag: boolean = flags.has('-E') || flags.has('-P') || flags.has('-G');
  if (!hasRegexFlag) {
    flags.set('-i', '');
    flags.set('-F', '');
  }
  let env = '';
  if (flags.has('-P')) {
    env = `LC_ALL=en_US.utf8 `;
  }
  return `${env}grep ${stringifyFlags(flags)} ${searchText} ${getGenshinDataFilePath(file)}`;
}

export async function grep(searchText: string, file: string, extraFlags?: string, escapeDoubleQuotes: boolean = true): Promise<string[]> {
  try {
    const cmd = createGrepCommand(searchText, file, extraFlags, escapeDoubleQuotes);
    console.log('Command:', cmd);
    const { stdout, stderr } = await execPromise(cmd, {
      env: { PATH: process.env.SHELL_PATH },
      shell: process.env.SHELL_EXEC,
    });
    return stdout.split(/\n/).map(s => s.trim()).filter(x => !!x);
  } catch (err) {
    if (err && err.code === 1) {
      return []; // exit code of 1 is no matches found - not an error for our use case
    } else if (err && err.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
      throw 'Max buffer reached (too many results).';
    } else {
      console.error('\x1b[4m\x1b[1mshell error:\x1b[0m\n', err);
      throw 'Text map search error.';
    }
  }
}

export async function grepStream(searchText: string, file: string, stream: (line: string) => void, extraFlags?: string): Promise<number|Error> {
  const cmd = createGrepCommand(searchText, file, extraFlags);
  return await passthru(cmd, stream);
}

export async function grepIdStartsWith(idProp: string, idPrefix: number | string, file: string): Promise<(number | string)[]> {
  let isInt = typeof idPrefix === 'number';
  let grepSearchText = `"${idProp}": ${isInt ? idPrefix : '"' + idPrefix}`;
  let lines = await grep(grepSearchText, file, null, false);
  let out = [];
  for (let line of lines) {
    let parts = /":\s+"?([^",$]+)/.exec(line);
    out.push(isInt ? parseInt(parts[1]) : parts[1]);
  }
  return out;
}

export function normJsonGrep(s: string) {
  return s.replace(/\\"/g, '"').replace(/\\n/g, '\n');
}

export function normJsonGrepCmp(a: string, b: string) {
  return normJsonGrep(a).toLowerCase() === normJsonGrep(b).toLowerCase();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  let parsed = parseFlags('--test-flag -abc -m 10 --another --foo bar -D -e');
  console.log(parsed);

  let stringified = stringifyFlags(parsed);
  console.log(stringified);
}