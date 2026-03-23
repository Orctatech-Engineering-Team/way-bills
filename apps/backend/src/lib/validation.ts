import { z } from 'zod'
import { isValidGhanaPhone, normalizeAddress, normalizeGhanaPhone } from './contact'

function isValidDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).valueOf())
}

function isValidDateTime(value: string) {
  return !Number.isNaN(new Date(value).valueOf())
}

export function requiredText(field: string, min = 1) {
  const schema = z.string().trim()

  if (min <= 1) {
    return schema.min(1, `${field} is required.`)
  }

  return schema
    .min(1, `${field} is required.`)
    .min(min, `${field} must be at least ${min} characters.`)
}

export function ghanaPhoneField(field: string) {
  return z
    .string()
    .trim()
    .min(1, `${field} is required.`)
    .refine(
      isValidGhanaPhone,
      `${field} must be a valid Ghana phone number in 0XXXXXXXXX or +233XXXXXXXXX format.`,
    )
    .transform((value) => normalizeGhanaPhone(value)!)
}

export function optionalNullableGhanaPhoneField(field: string) {
  return z
    .string()
    .trim()
    .nullable()
    .optional()
    .refine(
      (value) => value == null || value === '' || isValidGhanaPhone(value),
      `${field} must be a valid Ghana phone number in 0XXXXXXXXX or +233XXXXXXXXX format.`,
    )
    .transform((value) => {
      if (value == null || value === '') {
        return value ?? null
      }

      return normalizeGhanaPhone(value)!
    })
}

export function optionalGhanaPhoneField(field: string) {
  return z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => value == null || value === '' || isValidGhanaPhone(value),
      `${field} must be a valid Ghana phone number in 0XXXXXXXXX or +233XXXXXXXXX format.`,
    )
    .transform((value) => {
      if (value == null || value === '') {
        return value
      }

      return normalizeGhanaPhone(value)!
    })
}

export function addressField(field: string, min = 5) {
  return z
    .string()
    .trim()
    .min(1, `${field} is required.`)
    .transform(normalizeAddress)
    .refine((value) => value.length >= min, `${field} must be at least ${min} characters.`)
}

export function optionalNullableAddressField(field: string, min = 5) {
  return z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => {
      if (value == null || value === '') {
        return value ?? null
      }

      return normalizeAddress(value)
    })
    .refine(
      (value) => value == null || value.length >= min,
      `${field} must be at least ${min} characters.`,
    )
}

export function optionalNullableText(field: string, min = 1) {
  return requiredText(field, min).nullable().optional()
}

export function optionalText(field: string, min = 1) {
  return requiredText(field, min).optional()
}

export function requiredId(field: string) {
  return z.string().trim().min(1, `${field} is required.`)
}

export function optionalNullableId(field: string) {
  return requiredId(field).nullable().optional()
}

export function imageDataUrlField(field: string) {
  return z
    .string()
    .min(20, `${field} is invalid.`)
    .refine((value) => value.startsWith('data:'), `${field} is invalid.`)
}

export function optionalImageDataUrlField(field: string) {
  return imageDataUrlField(field).optional()
}

export function nullableImageDataUrlField(field: string) {
  return imageDataUrlField(field).nullable()
}

export function dateOnlyField(field: string) {
  return z
    .string()
    .trim()
    .min(1, `${field} is required.`)
    .refine(isValidDateOnly, `${field} must be a valid YYYY-MM-DD date.`)
}

export function optionalDateTimeField(field: string) {
  return z
    .string()
    .trim()
    .min(1, `${field} is required.`)
    .refine(isValidDateTime, `${field} must be a valid date and time.`)
    .optional()
}

export function nullableOptionalDateTimeField(field: string) {
  return z
    .string()
    .trim()
    .min(1, `${field} is required.`)
    .refine(isValidDateTime, `${field} must be a valid date and time.`)
    .nullable()
    .optional()
}
