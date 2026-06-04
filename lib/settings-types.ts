export interface BankAccount {
  bank_name: string
  account_name: string
  account_number: string
  ifsc: string
  branch: string
}

export interface StoreSettings {
  bank_accounts: BankAccount[]
  terms_conditions: string[]
  stamp_image_url: string
  signature_image_url: string
}

export const MAX_BANK_ACCOUNTS = 5

export const EMPTY_BANK: BankAccount = {
  bank_name: '',
  account_name: '',
  account_number: '',
  ifsc: '',
  branch: '',
}
