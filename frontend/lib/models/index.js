import mongoose from 'mongoose';

// Hot reload and warm serverless containers re-run this module, so every model is
// registered through mongoose.models first to avoid OverwriteModelError.
const model = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);

// There is one kind of account and it reaches every screen. `role` is a job title
// printed under the name in the sidebar — it carries no access meaning, so renaming
// somebody to «فروشنده» does not take anything away from them.
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, required: true, default: 'مدیر' },
  initials: String,
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  // The one real gate: a deactivated account cannot sign in.
  active: { type: Boolean, default: true }
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  unit: { type: String, required: true, default: 'دانه' },   // کیلو | قطی | بسته | بوتل …
  supplier: { type: String, default: '' },
  barcode: { type: String, default: '' },
  buy: { type: Number, required: true },
  retail: { type: Number, required: true },
  // Wholesale price kicks in once the line quantity reaches Setting.wholesaleMinQty.
  // Zero means this product has no wholesale price and always sells at retail.
  wholesale: { type: Number, default: 0 },
  stock: { type: Number, default: 0 },
  expiry: { type: String, default: '' }              // 'YYYY-MM-DD' Gregorian, shown as Jalali
}, { timestamps: true });

productSchema.index({ barcode: 1 });

const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  person: String,
  phone: String,
  address: String,
  supplies: String,                                  // free text: what they deliver
  balance: { type: Number, default: 0 },             // outstanding payable
  lastOrder: { type: String, default: '' }
}, { timestamps: true });

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, default: '' },
  note: String,
  since: Date,
  lastBuy: Date,
  credit: { type: Number, default: 0 }               // outstanding قرض balance
}, { timestamps: true });

const saleItemSchema = new mongoose.Schema({
  product: mongoose.Schema.Types.ObjectId,
  name: String,
  unit: String,
  qty: Number,
  price: Number,                                     // unit price actually charged
  listPrice: Number,                                 // retail price before any discount
  buy: Number,                                       // buy price at time of sale
  returned: { type: Number, default: 0 }             // units already given back
}, { _id: false });

const saleSchema = new mongoose.Schema({
  no: { type: String, required: true, unique: true },
  date: { type: Date, default: Date.now },
  customer: { type: String, default: 'مشتری نقدی' },
  phone: { type: String, default: '' },
  items: [saleItemSchema],
  sub: Number,                                       // sum of line totals as charged
  autoDisc: { type: Number, default: 0 },            // from active discount rules
  autoDiscNote: { type: String, default: '' },
  disc: { type: Number, default: 0 },                // manual discount on top
  vat: { type: Number, default: 0 },
  total: Number,
  payment: { type: String, enum: ['نقد', 'کارت', 'موبایل', 'قرض'], default: 'نقد' },
  servedBy: String
}, { timestamps: true });

const returnItemSchema = new mongoose.Schema({
  name: String,
  qty: Number,
  price: Number,
  buy: Number
}, { _id: false });

const returnSchema = new mongoose.Schema({
  rn: { type: String, required: true, unique: true },
  sale: { type: String, required: true },            // the bill number it came from
  date: { type: Date, default: Date.now },
  items: [returnItemSchema],
  total: Number,                                     // money handed back
  reason: { type: String, default: '' },
  restocked: { type: Boolean, default: true },       // false when goods are unsellable
  handledBy: String
}, { timestamps: true });

const purchaseLineSchema = new mongoose.Schema({
  product: mongoose.Schema.Types.ObjectId,
  name: String,
  qty: Number,
  cost: Number                                       // unit buy price on this order
}, { _id: false });

const purchaseSchema = new mongoose.Schema({
  po: { type: String, required: true, unique: true },
  supplier: { type: String, required: true },
  date: { type: Date, default: Date.now },
  lines: [purchaseLineSchema],
  total: Number,
  status: { type: String, enum: ['در انتظار', 'تحویل شده'], default: 'در انتظار' },
  paid: { type: Boolean, default: false },
  receivedAt: Date,
  createdBy: String
}, { timestamps: true });

const discountSchema = new mongoose.Schema({
  name: { type: String, required: true },
  kind: { type: String, enum: ['percent', 'amount'], default: 'percent' },
  value: { type: Number, required: true },           // percent, or currency off per unit
  scope: { type: String, enum: ['all', 'category', 'product'], default: 'all' },
  target: { type: String, default: '' },             // category name or product name
  from: Date,
  to: Date,                                          // empty `to` means open-ended
  active: { type: Boolean, default: true }
}, { timestamps: true });

const transactionSchema = new mongoose.Schema({
  t: { type: Date, default: Date.now },
  type: { type: String, enum: ['درآمد', 'مصرف'], required: true },
  desc: { type: String, required: true },
  // Purchases and supplier payments are already inside cost of goods sold, so the
  // profit and loss report excludes any entry tagged 'stock'.
  tag: { type: String, enum: ['sale', 'credit', 'stock', 'salary', 'return', 'other'], default: 'other' },
  amount: { type: Number, required: true }
}, { timestamps: true });

const activityLogSchema = new mongoose.Schema({
  t: { type: Date, default: Date.now },
  user: { type: String, default: 'سیستم' },
  action: { type: String, required: true }
});

const counterSchema = new mongoose.Schema({
  key: { type: String, unique: true },               // 'sale' | 'po' | 'return'
  seq: { type: Number, default: 0 }
});

const settingSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'global' },
  currency: { type: String, default: 'AFN' },
  vatRate: { type: Number, default: 0 },
  lowStockThreshold: { type: Number, default: 10 },
  expiryWarnDays: { type: Number, default: 60 },
  // A line of this many units or more is billed at the product's wholesale price.
  wholesaleMinQty: { type: Number, default: 50 },
  autoBackup: { type: Boolean, default: true },
  lastBackup: Date,
  // Printed on every bill and report; edited under امنیت و بک‌اپ.
  storeName: { type: String, default: 'طلوع نوین' },
  storeAddress: { type: String, default: '' },
  storePhone: { type: String, default: '' },
  storeLicense: { type: String, default: '' }
});

export const User = model('User', userSchema);
export const Product = model('Product', productSchema);
export const Supplier = model('Supplier', supplierSchema);
export const Customer = model('Customer', customerSchema);
export const Sale = model('Sale', saleSchema);
export const Return = model('Return', returnSchema);
export const Purchase = model('Purchase', purchaseSchema);
export const Discount = model('Discount', discountSchema);
export const Transaction = model('Transaction', transactionSchema);
export const ActivityLog = model('ActivityLog', activityLogSchema);
export const Counter = model('Counter', counterSchema);
export const Setting = model('Setting', settingSchema);

export const COLLECTIONS = ['User', 'Product', 'Supplier', 'Customer', 'Sale', 'Return',
  'Purchase', 'Discount', 'Transaction', 'ActivityLog', 'Counter', 'Setting'];

export async function nextSeq(key) {
  const doc = await Counter.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return doc.seq;
}

export async function getSettings() {
  let s = await Setting.findOne({ key: 'global' });
  if (!s) s = await Setting.create({ key: 'global' });
  return s;
}

export async function logAct(user, action) {
  try { await ActivityLog.create({ user: user || 'سیستم', action }); } catch { /* non-fatal */ }
}
