import { safeHtml, type EduLesson, type EduLessonBlock } from "@/lib/education";
import { useI18n } from "@/lib/i18n";

function fileUrl(value: EduLessonBlock["value"]): string {
  if (typeof value === "string") return value;
  return value?.url || "";
}

function fileTitle(value: EduLessonBlock["value"], fallback: string): string {
  if (typeof value === "string") return fallback;
  return value?.title || fallback;
}

function embedSrc(url: string): string | null {
  const youtube = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

function BlockView({ block }: { block: EduLessonBlock }) {
  const { t } = useI18n();
  if (block.type === "heading") {
    return <h3 className="text-base font-bold text-ink">{String(block.value)}</h3>;
  }
  if (block.type === "paragraph") {
    return (
      <div
        className="text-sm leading-7 text-ink [&_a]:text-navy-800 [&_li]:ms-5 [&_ol]:list-decimal [&_ul]:list-disc"
        dangerouslySetInnerHTML={{ __html: safeHtml(String(block.value)) }}
      />
    );
  }
  if (block.type === "quote") {
    return <blockquote className="border-s-2 border-brand-500 ps-3 text-sm leading-7 text-gray-700">{String(block.value)}</blockquote>;
  }
  if (block.type === "code") {
    return (
      <pre className="overflow-x-auto rounded-xl bg-navy-900 p-3 text-xs leading-6 text-gray-100" dir="ltr">
        <code>{String(block.value)}</code>
      </pre>
    );
  }
  if (block.type === "image") {
    const src = fileUrl(block.value);
    if (!src) return null;
    return <img src={src} alt={fileTitle(block.value, "")} className="max-h-80 w-full rounded-xl object-cover" />;
  }
  if (block.type === "document") {
    const href = fileUrl(block.value);
    if (!href) return null;
    return (
      <a href={href} className="text-sm font-medium text-navy-800 hover:text-link" target="_blank" rel="noreferrer">
        {fileTitle(block.value, t("edu.downloadFile"))}
      </a>
    );
  }
  if (block.type === "video_embed") {
    const url = String(block.value);
    const embed = embedSrc(url);
    if (embed) {
      return (
        <div className="aspect-video overflow-hidden rounded-xl bg-navy-900">
          <iframe src={embed} title={t("edu.watchVideo")} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      );
    }
    return (
      <a href={url} className="text-sm text-navy-800 hover:text-link" target="_blank" rel="noreferrer">
        {t("edu.watchVideo")}
      </a>
    );
  }
  return null;
}

export default function LessonStream({ lesson }: { lesson: EduLesson }) {
  const { t } = useI18n();
  const blocks = lesson.content ?? [];
  const heroVideo = embedSrc(lesson.video_url || "");

  return (
    <div className="mt-4 space-y-4">
      {lesson.featured_image_url ? (
        <img src={lesson.featured_image_url} alt="" className="max-h-72 w-full rounded-xl object-cover" />
      ) : null}
      {lesson.short_description ? <p className="text-sm text-gray-600">{lesson.short_description}</p> : null}
      {lesson.video_file_url ? (
        <video
          className="aspect-video w-full rounded-xl bg-navy-900"
          src={lesson.video_file_url}
          controls
          preload="metadata"
        />
      ) : null}
      {!lesson.video_file_url && lesson.video_url ? (
        heroVideo ? (
          <div className="aspect-video overflow-hidden rounded-xl bg-navy-900">
            <iframe src={heroVideo} title={t("edu.watchVideo")} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          </div>
        ) : (
          <a href={lesson.video_url} className="text-sm text-navy-800 hover:text-link" target="_blank" rel="noreferrer">
            {t("edu.watchVideo")}
          </a>
        )
      ) : null}
      {lesson.document_url ? (
        <a href={lesson.document_url} className="block text-sm font-medium text-navy-800 hover:text-link" target="_blank" rel="noreferrer">
          {lesson.document_title || t("edu.downloadFile")}
        </a>
      ) : null}
      {blocks.length
        ? blocks.map((block, index) => <BlockView key={`${block.type}-${index}`} block={block} />)
        : (
          <div
            className="space-y-3 text-sm leading-7 text-ink [&_a]:text-navy-800 [&_li]:ms-5 [&_ol]:list-decimal [&_ul]:list-disc"
            dangerouslySetInnerHTML={{ __html: safeHtml(lesson.body) }}
          />
        )}
    </div>
  );
}
