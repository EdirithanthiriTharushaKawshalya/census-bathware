import Link from "next/link";
import Image from "next/image";
import logo from "@/assets/census-logo.png";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Census Bathware home">
      <Image
        src={logo}
        alt="Census Bathware"
        width={1353}
        height={1162}
        sizes="180px"
        className="brand-logo"
      />
    </Link>
  );
}
