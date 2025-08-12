import { AdminPanel } from "@/components/AdminPanel";
import UserHeader from "@/components/UserHeader";

const Admin = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <UserHeader />
      <div className="flex-1">
        <AdminPanel />
      </div>
    </div>
  );
};

export default Admin;