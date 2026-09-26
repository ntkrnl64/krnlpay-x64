export type Order = {
  id: number;
  order_no: string;
  order_name: string;
  amount: number;
  qrcode: string;
  source: string;
  status: string;
  is_paid: boolean;
  is_deleted: boolean;
  product_id: number | null;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  enabled: boolean;
  sort_order: number;
};

export type ShopSettings = {
  shop_name: string;
  icon: string;
  tagline: string;
  about: string;
  thank_you: string;
  custom_enabled: boolean;
  custom_min: number;
  custom_max: number;
  presets: number[];
  success_redirect: string;
};

export type Shop = ShopSettings & { products: Product[] };

export type Pager = {
  CurrentPage: number;
  PerPage: number;
  TotalPage: number;
  TotalCount: number;
  NextPageURL: string;
  PrevPageURL: string;
};
