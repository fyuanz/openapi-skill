import { isDeepStrictEqual } from 'node:util';
import { asObject, JsonObject } from '../input/parse.js';

/** Omit only exact copies. This metadata makes the original representation reconstructible. */
export function compactContract(contract: JsonObject): JsonObject {
  const output = { ...contract };
  const omitted: string[] = [];
  for (const key of ['pathItem', 'operation']) {
    const owner = asObject(contract[key]);
    if (owner && Array.isArray(owner.parameters) && isDeepStrictEqual(owner.parameters, contract.parameters)) {
      const copy = { ...owner }; delete copy.parameters; output[key] = copy;
      omitted.push(`${key}.parameters`);
    }
  }
  if (omitted.length) output.omittedEqualParameters = omitted;
  return output;
}
