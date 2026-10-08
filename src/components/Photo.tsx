// A served photo with its source caption. Width and height are set so the layout never
// shifts while it loads. Permission is unverified; the caption says so.
import {photos} from '../photos.ts';
import {useT} from '../lib/i18n.tsx';
import {cn} from '../lib/cn.ts';

export function Photo({
  slot,
  sizes,
  className,
  imgClassName,
  priority = false,
  caption = true,
}: {
  slot: string;
  sizes: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  caption?: boolean;
}) {
  const {lang} = useT();
  const photo = photos[slot];
  if (!photo) return null;
  return (
    <figure className={cn('space-y-2', className)}>
      <img
        src={photo.src}
        srcSet={photo.srcset}
        sizes={sizes}
        width={photo.width}
        height={photo.height}
        alt={photo.alt[lang]}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={cn('block h-auto w-full rounded-2xl bg-stone-200 object-cover', imgClassName)}
        style={{aspectRatio: `${photo.width} / ${photo.height}`}}
      />
      {caption && photo.caption ? (
        <figcaption className="text-sm leading-5 text-muted">{photo.caption[lang]}</figcaption>
      ) : null}
    </figure>
  );
}
