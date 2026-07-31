// Sidebar and page titles, keyed by permission.
export const LABELS = {
  dash: 'داشبورد',
  pos: 'صندوق فروش',
  inv: 'موجودی و گدام',
  pur: 'خرید و تهیه‌کنندگان',
  cust: 'مشتریان و قرض‌ها',
  rep: 'راپورها',
  price: 'قیمت‌ها و تخفیفات',
  sec: 'امنیت و بک‌اپ'
};

export const SUBTITLES = {
  dash: 'خلاصهٔ فعالیت‌های امروز سوپرمارکت',
  pos: 'فروش سریع با اسکن بارکد و چاپ بل',
  inv: 'ثبت اجناس، پیگیری موجودی و تاریخ انقضا',
  pur: 'سفارشات خرید و قرضداری‌ها',
  cust: 'ثبت قرض مشتریان و تاریخچهٔ خرید',
  rep: 'راپور فروش، مفاد و ضرر، اجناس پرفروش',
  price: 'قیمت‌گذاری پرچون/عمده و تخفیف‌های موسمی',
  sec: 'ثبت فعالیت‌ها و بک‌اپ معلومات'
};

// Name and address are stored in the database and edited under امنیت و بک‌اپ; these
// are only the fallbacks used before the settings load.
export const DEFAULT_STORE = {
  storeName: 'طلوع نوین',
  storeAddress: '',
  storePhone: '',
  storeLicense: ''
};

// Starting points only — both lists are free text on the product form.
export const CATEGORIES = ['مواد خوراکی', 'نوشیدنی', 'لبنیات', 'لوازم خانه',
  'شوینده و صحی', 'خوراکهٔ اطفال', 'تنقلات', 'قرطاسیه', 'متفرقه'];

export const UNITS = ['دانه', 'کیلو', 'گرام', 'قطی', 'بسته', 'بوتل', 'بوجی', 'تخته', 'کارتن', 'لیتر', 'متر'];

export const PAYMENTS = ['نقد', 'کارت', 'موبایل', 'قرض'];

// Job titles offered on the account form. They are labels only — every account
// reaches every screen regardless of which one is picked.
export const JOB_TITLES = ['مدیر', 'مدیر عمومی', 'صندوق‌دار', 'فروشنده', 'گدام‌دار', 'حسابدار'];
