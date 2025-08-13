import { LandingPage } from "@/components/LandingPage";
import UserHeader from "@/components/UserHeader";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <UserHeader />
      <div className="flex-1">
        <LandingPage />
      </div>
    </div>
  );
};

export default Index;
