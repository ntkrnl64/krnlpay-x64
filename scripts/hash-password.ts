import { CodedError } from "../worker/http/errors.ts";
import { hashPassword } from "../worker/domain/password.ts";

const password = (await Bun.stdin.text()).trim();
try {
  process.stdout.write(`${hashPassword(password)}\n`);
} catch (error) {
  if (error instanceof CodedError) {
    process.stderr.write(`${error.code}: ${error.message}\n`);
    process.exit(1);
  }
  throw error;
}
