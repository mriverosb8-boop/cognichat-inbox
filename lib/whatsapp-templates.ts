export const WHATSAPP_TEMPLATES = [
  {
    label: "Confirmar asistencia de reserva",
    value: "confirmar_asistencia_reserva",
    variables: [],
  },
  {
    label: "Objeto olvidado",
    value: "objeto_olvidado_habitacion",
    variables: [
      {
        key: "nombre",
        label: "Nombre del huésped",
        placeholder: "Ej: Carlos Pérez",
      },
      {
        key: "fecha",
        label: "Fecha del hallazgo",
        placeholder: "Ej: 11 de mayo de 2026",
      },
      {
        key: "habitacion",
        label: "Habitación",
        placeholder: "Ej: 4401",
      },
      {
        key: "objeto",
        label: "Objeto olvidado",
        placeholder: "Ej: un adaptador de cargador",
      },
    ],
  },
] as const;

export type WhatsappTemplateName = (typeof WHATSAPP_TEMPLATES)[number]["value"];
export type WhatsappTemplateVariableKey =
  (typeof WHATSAPP_TEMPLATES)[number]["variables"][number]["key"];
export type WhatsappTemplateVariables = Partial<Record<WhatsappTemplateVariableKey, string>>;

export function normalizeColombianWhatsappNumber(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10 && digits.startsWith("3")) {
    return `57${digits}`;
  }

  return digits;
}

export function isWhatsappTemplateName(value: string): value is WhatsappTemplateName {
  return WHATSAPP_TEMPLATES.some((template) => template.value === value);
}

export function getWhatsappTemplate(value: string) {
  return WHATSAPP_TEMPLATES.find((template) => template.value === value) ?? null;
}
