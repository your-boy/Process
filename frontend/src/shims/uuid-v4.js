// Compatibility shim for legacy packages that import `uuid/v4`.
import { v4 } from 'uuid'

export { v4 }
export default v4
