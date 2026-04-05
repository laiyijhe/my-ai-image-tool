import type { SendMessagesParams } from "@liff/send-messages";

export function buildPdfShareFlex(
  downloadUrl: string,
  fileLabel: string,
  labels: {
    altText: string;
    title: string;
    subtitle: string;
    download: string;
  }
): SendMessagesParams {
  const safeLabel =
    fileLabel.length > 80 ? `${fileLabel.slice(0, 77)}…` : fileLabel;

  return [
    {
      type: "flex",
      altText: labels.altText,
      contents: {
        type: "bubble",
        size: "kilo",
        body: {
          type: "box",
          layout: "vertical",
          spacing: "md",
          contents: [
            {
              type: "text",
              text: labels.title,
              weight: "bold",
              size: "md",
              wrap: true,
            },
            {
              type: "text",
              text: labels.subtitle,
              size: "xs",
              color: "#888888",
              wrap: true,
            },
            {
              type: "text",
              text: safeLabel,
              size: "sm",
              wrap: true,
            },
            {
              type: "button",
              style: "primary",
              height: "sm",
              action: {
                type: "uri",
                label: labels.download,
                uri: downloadUrl,
              },
            },
          ],
        },
      },
    },
  ];
}
