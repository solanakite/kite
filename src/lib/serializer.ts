export const log = console.log;

// See https://stackoverflow.com/questions/65152373/typescript-serialize-bigint-in-json
function bigIntReplacer(key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString() + "n";
  }
  return value;
}

// Sometimes we need to show a bigInt value as JSON
export const stringify = (value: unknown) => JSON.stringify(value, bigIntReplacer, 2);
