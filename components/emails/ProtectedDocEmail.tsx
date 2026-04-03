import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type ProtectedDocEmailProps = {
  recipientEmail: string;
  attachmentFileName: string;
};

const main = {
  backgroundColor: "#0f172a",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "32px 24px 48px",
  maxWidth: "560px",
};

const heading = {
  color: "#e2e8f0",
  fontSize: "22px",
  fontWeight: "600",
  lineHeight: "1.3",
  margin: "0 0 16px",
};

const paragraph = {
  color: "#94a3b8",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const badge = {
  display: "inline-block",
  backgroundColor: "rgba(34, 211, 238, 0.12)",
  color: "#67e8f9",
  fontSize: "11px",
  fontWeight: "600",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  padding: "6px 12px",
  borderRadius: "999px",
  marginBottom: "20px",
};

const footer = {
  color: "#64748b",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "24px 0 0",
};

export function ProtectedDocEmail({
  recipientEmail,
  attachmentFileName,
}: ProtectedDocEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Your licensed PDF from Creator Guard — {attachmentFileName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={badge}>Creator Guard</Section>
          <Heading style={heading}>Your protected document is ready</Heading>
          <Text style={paragraph}>
            Hi — we&apos;ve attached your personalized, watermarked PDF (
            <strong style={{ color: "#cbd5e1" }}>{attachmentFileName}</strong>
            ). This copy is licensed for{" "}
            <strong style={{ color: "#cbd5e1" }}>{recipientEmail}</strong>.
          </Text>
          <Text style={paragraph}>
            Please keep this file for your records. If you didn&apos;t expect
            this email, you can ignore it or contact your creator.
          </Text>
          <Hr
            style={{
              borderColor: "#1e293b",
              margin: "28px 0",
            }}
          />
          <Text style={footer}>
            Creator Guard — digital content protection for creators.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ProtectedDocEmail;
