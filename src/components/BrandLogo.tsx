import Image from "next/image";

const CREATIVE_WACO_HOME = "https://creativewaco.org/";
const CREATIVE_WACO_LOGO_URL =
  "https://yrnfoftkuamimcaownig.supabase.co/storage/v1/object/public/culturalyst/is5gglgrgelofzc4ia7bm4cqfu71";

type Props = {
  className?: string;
  imgClassName?: string;
};

export function BrandLogo({ className, imgClassName }: Props) {
  return (
    <a
      href={CREATIVE_WACO_HOME}
      className={className}
      data-brand-chrome=""
      aria-label="Creative Waco — visit creativewaco.org"
    >
      <Image
        src={CREATIVE_WACO_LOGO_URL}
        alt=""
        width={220}
        height={56}
        className={imgClassName}
        priority
        sizes="220px"
      />
    </a>
  );
}
