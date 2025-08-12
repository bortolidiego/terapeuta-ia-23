import { SimplifiedChat } from "@/components/SimplifiedChat";
import UserHeader from "@/components/UserHeader";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <UserHeader />
      <div className="flex-1">
        <SimplifiedChat />
      </div>
    </div>
  );
};

export default Index;
