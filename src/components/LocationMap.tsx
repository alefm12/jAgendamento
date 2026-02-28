import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MapPin, NavigationArrow, X } from '@phosphor-icons/react'
import type { Location } from '@/lib/types'

interface LocationMapProps {
  location: Location
  onClose?: () => void
  showCloseButton?: boolean
}

export function LocationMap({ location, onClose, showCloseButton = false }: LocationMapProps) {
  const [mapUrl, setMapUrl] = useState<string>('')

  useEffect(() => {
    const address = encodeURIComponent(`${location.address}, ${location.city}`)
    const embedUrl = `https://www.google.com/maps?q=${address}&output=embed`
    setMapUrl(embedUrl)
  }, [location])

  const handleOpenInMaps = () => {
    if (location.googleMapsUrl) {
      window.open(location.googleMapsUrl, '_blank', 'noopener,noreferrer')
    } else {
      const address = encodeURIComponent(`${location.address}, ${location.city}`)
      window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <Card className="overflow-hidden card-hover">
      <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 text-xl">
              <MapPin size={24} weight="duotone" className="text-green-600" />
              {location.name}
            </CardTitle>
            <CardDescription className="mt-2 text-base text-muted-foreground">
              {location.address}
            </CardDescription>
          </div>
          {showCloseButton && onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="hover:bg-red-100 hover:text-red-600"
            >
              <X size={20} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="p-6 bg-white space-y-4">
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <MapPin size={20} weight="fill" className="text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Endereço Completo:</p>
                <p className="text-muted-foreground">{location.address}</p>
                <p className="text-muted-foreground">{location.city}</p>
              </div>
            </div>
          </div>

          <div className="relative w-full h-[400px] rounded-xl overflow-hidden border-4 border-green-100 shadow-2xl">
            <iframe
              src={mapUrl}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`Mapa de ${location.name}`}
              className="w-full h-full"
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleOpenInMaps}
              className="flex-1 gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg shadow-green-500/30 button-glow"
              size="lg"
            >
              <NavigationArrow size={20} weight="fill" />
              Abrir no Google Maps
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            💡 Clique no botão acima para ver rotas e instruções de navegação
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
