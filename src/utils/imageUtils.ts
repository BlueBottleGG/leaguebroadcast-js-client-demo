export function handleImageError(event: Event) {
  const target = event.target
  if (target instanceof HTMLImageElement) {
    target.style.display = 'none'
  }
}

export function handleImageLoad(event: Event) {
  const target = event.target
  if (target instanceof HTMLImageElement) {
    target.style.display = ''
  }
}
