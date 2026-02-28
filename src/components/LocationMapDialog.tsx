import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { LocationMap } from './LocationMap'
import type { Location } from '@/lib/types'

interface LocationMapDialogProps {
  location: Location | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LocationMapDialog({ location, open, onOpenChange }: LocationMapDialogProps) {
  if (!location) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="sr-only">
          Mapa de {location.name}
        </DialogTitle>
        <LocationMap 
          location={location}
          onClose={() => onOpenChange(false)}
          showCloseButton={false}
        />
      </DialogContent>
    </Dialog>
  )
}
