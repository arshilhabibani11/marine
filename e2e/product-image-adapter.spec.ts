import { expect, test } from '@playwright/test'
import { apiProductToFrontend } from '../src/lib/adapters'

test('preserves the selected Cloudinary main image throughout the storefront model', () => {
  const mainUrl = 'https://res.cloudinary.com/y7up4zti/image/upload/v123/alka/main-image.webp'
  const alternateUrl = 'https://res.cloudinary.com/y7up4zti/image/upload/v123/alka/alternate-image.webp'

  const product = apiProductToFrontend({
    id: '84d51a63-5fe7-49bb-b506-0e714aaf40e0',
    name: 'Cloudinary test pump',
    sku: 'CLOUDINARY-TEST',
    slug: 'cloudinary-test-pump',
    status: 'published',
    availability: 'in-stock',
    condition: 'used',
    regularPrice: 100,
    currency: 'USD',
    showPrice: true,
    makeOfferEnabled: false,
    stockCount: 1,
    lowStockThreshold: 1,
    isNewArrival: false,
    isFeatured: false,
    sortPriority: 0,
    images: [
      { id: 'alternate', url: alternateUrl, isMain: false, sortOrder: 0 },
      { id: 'main', url: mainUrl, isMain: true, sortOrder: 1 },
    ],
    specs: [],
    industries: [],
  })

  expect(product.filename).toBe(mainUrl)
  expect(product.images.map((image) => image.url)).toEqual([alternateUrl, mainUrl])
})
