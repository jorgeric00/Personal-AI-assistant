import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/**
 * Guarda un archivo generado por la app. En Android se abre el menú de compartir del sistema para que la persona
 * elija dónde guardarlo (Archivos, una memoria USB, su nube…): la app no lo envía a ningún sitio por su cuenta.
 */
export async function saveFile(name: string, bytes: Uint8Array, mimeType: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mimeType }))
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return
  }
  const { uri } = await Filesystem.writeFile({ path: name, data: toBase64(bytes), directory: Directory.Cache })
  try {
    await Share.share({ title: name, files: [uri] })
  } catch (error) {
    // Cerrar el menú sin elegir nada no es un error.
    if (!String(error).toLowerCase().includes('cancel')) throw error
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}
