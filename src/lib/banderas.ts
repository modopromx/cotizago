// Banderas SVG que de verdad usa la app (selector de idioma y de país del
// teléfono). Antes se hacía `import * as Banderas`, que metía las ~250 banderas
// del paquete en el bundle de la portada.
import {
  MX, US, CO, AR, CL, PE, EC, GT, CR, PA, DO, SV, HN, NI, BO, PY, UY, VE, BR, ES, FR,
} from 'country-flag-icons/react/3x2'

export const BANDERAS: Record<string, any> = {
  MX, US, CO, AR, CL, PE, EC, GT, CR, PA, DO, SV, HN, NI, BO, PY, UY, VE, BR, ES, FR,
}
