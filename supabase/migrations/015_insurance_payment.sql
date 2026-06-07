-- Insurance payment support
-- insurance_company: name of insurer (e.g. Bajaj Allianz)
-- insurance_claim_no: policy/claim reference number
alter table invoices
  add column if not exists insurance_company text,
  add column if not exists insurance_claim_no text;
