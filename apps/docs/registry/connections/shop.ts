import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://mcp.shop.com",
  description:
    "Shop: find products, manage carts, checkouts, orders, and delegated budgets, and approve purchases.",
  auth: connect("shop"),
});
