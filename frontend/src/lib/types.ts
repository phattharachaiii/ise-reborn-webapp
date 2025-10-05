export type Product = {
  id: string;
  title: string;
  price: number;
  image: string;
  boosted?: boolean;
};

export type User = { id: string; name: string; email: string };
