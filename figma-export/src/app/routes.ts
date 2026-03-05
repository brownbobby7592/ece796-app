import { createBrowserRouter } from "react-router";
import { Scanner } from "./components/Scanner";
import { Dashboard } from "./components/Dashboard";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Scanner,
  },
  {
    path: "/dashboard/:deviceId",
    Component: Dashboard,
  },
]);
