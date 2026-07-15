export function handleImageError(event: Event) {
  const target = event.target
  if (target instanceof HTMLImageElement) {
    hideBrokenImage(target)
  }
}

export function handleImageLoad(event: Event) {
  const target = event.target
  if (target instanceof HTMLImageElement) {
    showLoadedImage(target)
  }
}

let globalImageErrorHandlingInstalled = false

function hideBrokenImage(image: HTMLImageElement) {
  image.dataset.imageLoadFailed = 'true'
  image.setAttribute('aria-hidden', 'true')
  image.style.display = 'none'
}

function showLoadedImage(image: HTMLImageElement) {
  delete image.dataset.imageLoadFailed
  image.removeAttribute('aria-hidden')
  image.style.display = ''
}

export function installGlobalImageErrorHandling() {
  if (globalImageErrorHandlingInstalled || typeof window === 'undefined') {
    return
  }

  globalImageErrorHandlingInstalled = true
  window.addEventListener('error', handleImageError, true)
  window.addEventListener('load', handleImageLoad, true)
}
