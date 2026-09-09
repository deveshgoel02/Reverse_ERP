import type { ImportEntityType } from "@/lib/enums";

export interface TargetField {
  key: string;
  label: string;
  required: boolean;
  /** Common header spellings seen in real-world Excel exports, lowercased. Used to boost mapping confidence. */
  aliases: string[];
  type: "string" | "number" | "date";
}

/**
 * What each entity type needs, and the header names real businesses
 * actually use for them (Module I: "columns may be differently named,
 * ordered, incomplete, inconsistent, legacy-formatted"). This is the
 * target side of the column-mapping suggestion in src/lib/import/mapping.ts.
 */
export const TARGET_FIELDS: Record<ImportEntityType, TargetField[]> = {
  SALES: [
    { key: "skuCode", label: "SKU Code", required: true, type: "string", aliases: ["item code", "sku", "product code", "item no", "code"] },
    { key: "quantity", label: "Quantity", required: true, type: "number", aliases: ["qty sold", "qty", "quantity sold", "units", "units sold"] },
    { key: "saleDate", label: "Sale Date", required: true, type: "date", aliases: ["sale dt", "date", "invoice date", "bill date"] },
    { key: "customerName", label: "Customer", required: false, type: "string", aliases: ["party name", "customer", "buyer", "party"] },
    { key: "invoiceRef", label: "Invoice Ref", required: false, type: "string", aliases: ["invoice no", "bill no", "invoice", "ref no"] },
    { key: "unitPrice", label: "Unit Price", required: false, type: "number", aliases: ["rate", "price", "selling price", "unit rate"] },
    { key: "discount", label: "Discount", required: false, type: "number", aliases: ["disc", "discount amount"] },
    { key: "tax", label: "Tax", required: false, type: "number", aliases: ["gst", "tax amount", "vat"] },
  ],
  PURCHASES: [
    { key: "skuCode", label: "SKU Code", required: true, type: "string", aliases: ["item code", "sku", "product code"] },
    { key: "quantityOrdered", label: "Quantity Ordered", required: true, type: "number", aliases: ["qty", "quantity", "order qty", "qty ordered"] },
    { key: "orderDate", label: "Order Date", required: true, type: "date", aliases: ["purchase dt", "po date", "date"] },
    { key: "supplierName", label: "Supplier", required: true, type: "string", aliases: ["party name", "supplier", "vendor"] },
    { key: "unitCost", label: "Unit Cost", required: true, type: "number", aliases: ["rate", "cost", "purchase price", "unit rate"] },
    { key: "invoiceRef", label: "PO / Invoice Ref", required: false, type: "string", aliases: ["po no", "invoice no", "bill no"] },
    { key: "quantityReceived", label: "Quantity Received", required: false, type: "number", aliases: ["qty received", "received qty"] },
  ],
  INVENTORY: [
    { key: "skuCode", label: "SKU Code", required: true, type: "string", aliases: ["item code", "sku", "product code"] },
    { key: "quantity", label: "Quantity", required: true, type: "number", aliases: ["qty", "stock", "closing stock", "balance qty"] },
    { key: "asOfDate", label: "As Of Date", required: false, type: "date", aliases: ["date", "stock date", "as on"] },
    { key: "note", label: "Note", required: false, type: "string", aliases: ["remarks", "notes"] },
  ],
  PRODUCTS: [
    { key: "skuCode", label: "SKU Code", required: true, type: "string", aliases: ["item code", "sku", "code"] },
    { key: "productName", label: "Product Name", required: true, type: "string", aliases: ["item name", "product", "description", "item description"] },
    { key: "brandName", label: "Brand", required: false, type: "string", aliases: ["brand name", "make"] },
    { key: "categoryName", label: "Category", required: false, type: "string", aliases: ["category name", "type"] },
    { key: "size", label: "Size", required: false, type: "string", aliases: ["size"] },
    { key: "color", label: "Colour", required: false, type: "string", aliases: ["color", "colour"] },
    { key: "purchasePrice", label: "Purchase Price", required: false, type: "number", aliases: ["cost price", "purchase rate"] },
    { key: "sellingPrice", label: "Selling Price", required: false, type: "number", aliases: ["sale price", "selling rate"] },
    { key: "mrp", label: "MRP", required: false, type: "number", aliases: ["mrp", "max retail price"] },
    { key: "gender", label: "Gender", required: false, type: "string", aliases: ["gender", "category type"] },
  ],
  CUSTOMERS: [
    { key: "name", label: "Name", required: true, type: "string", aliases: ["party name", "customer name", "shop name"] },
    { key: "phone", label: "Phone", required: false, type: "string", aliases: ["mobile", "contact no", "phone no"] },
    { key: "email", label: "Email", required: false, type: "string", aliases: ["email id", "e-mail"] },
    { key: "city", label: "City", required: false, type: "string", aliases: ["city", "location"] },
    { key: "address", label: "Address", required: false, type: "string", aliases: ["address", "addr"] },
  ],
  SUPPLIERS: [
    { key: "name", label: "Name", required: true, type: "string", aliases: ["party name", "supplier name", "vendor name"] },
    { key: "phone", label: "Phone", required: false, type: "string", aliases: ["mobile", "contact no", "phone no"] },
    { key: "email", label: "Email", required: false, type: "string", aliases: ["email id", "e-mail"] },
    { key: "leadTimeDays", label: "Lead Time (days)", required: false, type: "number", aliases: ["lead time", "delivery days"] },
    { key: "address", label: "Address", required: false, type: "string", aliases: ["address", "addr"] },
  ],
};
