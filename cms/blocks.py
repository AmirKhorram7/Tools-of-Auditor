from wagtail import blocks
from wagtail.documents.blocks import DocumentChooserBlock
from wagtail.images.blocks import ImageChooserBlock


class LessonStreamBlock(blocks.StreamBlock):
    """Blocks a teacher can stack inside a lesson."""

    heading = blocks.CharBlock(form_classname="title", icon="title", label="Heading")
    paragraph = blocks.RichTextBlock(
        features=["bold", "italic", "link", "ol", "ul", "h3", "h4"],
        icon="pilcrow",
        label="Text",
    )
    image = ImageChooserBlock(icon="image", label="Image")
    document = DocumentChooserBlock(icon="doc-full", label="Document")
    quote = blocks.BlockQuoteBlock(icon="openquote", label="Quote")
    code = blocks.TextBlock(icon="code", label="Code", help_text="Code snippet")
    video_embed = blocks.URLBlock(icon="media", label="Video link", help_text="YouTube, Vimeo, or other video URL")

    class Meta:
        label = "Lesson content"
