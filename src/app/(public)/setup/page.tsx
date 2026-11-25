import { Brand } from "@/components/ui/brand";
import { SetupState } from "@/components/ui/shared";
export default function Setup() {
  return (
    <>
      <header className="container public-header">
        <Brand />
      </header>
      <SetupState />
    </>
  );
}
