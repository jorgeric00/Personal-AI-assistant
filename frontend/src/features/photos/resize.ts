const MAX_SIDE = 2048

/**
 * Reduce la foto en el propio dispositivo antes de subirla: pesa menos y, al dibujarla de nuevo en un lienzo, se
 * pierden los metadatos del archivo (ubicación, modelo del móvil…). El servidor la vuelve a codificar igualmente.
 */
export async function prepareImage(file: Blob): Promise<Blob> {
  // createImageBitmap respeta la orientación EXIF, así que la foto queda derecha
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode'))), 'image/jpeg', 0.9),
  )
}
