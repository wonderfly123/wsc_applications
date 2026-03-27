declare global {
  interface Window {
    google: {
      maps: {
        places: {
          Autocomplete: new (
            input: HTMLInputElement,
            opts?: { types?: string[]; componentRestrictions?: { country: string } }
          ) => {
            addListener: (event: string, handler: () => void) => void
            getPlace: () => { formatted_address?: string }
          }
        }
      }
    }
  }
}

export {}
