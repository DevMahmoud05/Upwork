export function getMonthAbbreviation(monthIndex) {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return monthNames[monthIndex];
}

export function format12HourTime(date) {
  const hours = date.getHours() % 12 || 12;
  const minutes = date.getMinutes();
  const ampm = date.getHours() >= 12 ? "PM" : "AM";
  return `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
}

export const escapeMarkdown = (text) => {
  const strippedText = text.replace(/<[^>]+>/g, "");
  return strippedText.replace(/_/g, "\\_").replace(/\*/g, "\\*").replace(/\[/g, "\\[").replace(/`/g, "\\`").replace(/>/g, "\\>");
};

export const splitNewLine = (str, idx) => (idx === -1 ? "" : str.slice(idx).split("\n")[0].split(":")[1].trimStart());
