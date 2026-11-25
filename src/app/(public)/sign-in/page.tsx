import SignIn from "@/features/auth/sign-in";
export default function Page(props: {
  searchParams: Promise<{ notice?: string }>;
}) {
  return <SignIn {...props} />;
}
