import { loadStripe } from '@stripe/stripe-js'

// La publishable key es pública por diseño (va en el bundle). La secret key
// vive solo en los secrets de la Edge Function, nunca aquí.
const pk = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined

export const stripePromise = pk ? loadStripe(pk) : null
export const stripeConfigurado = !!pk
