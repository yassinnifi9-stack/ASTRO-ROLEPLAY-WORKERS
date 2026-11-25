let selectedTopic = "Support";
const authArea = document.getElementById("authArea");
const whitelistNotice = document.getElementById("whitelistNotice");
const ticketNotice = document.getElementById("ticketNotice");

function showNotice(el, message, error=false) {
  el.textContent = message;
  el.className = error ? "notice error" : "notice";
}
async function refreshUser() {
  try {
    const r = await fetch("/api/me");
    const data = await r.json();
    if (data.user) {
      authArea.innerHTML = `<span class="user-pill">Logged in: ${escapeHtml(data.user.username)}</span> <button class="btn btn-small btn-ghost" id="logoutBtn">Logout</button>`;
      document.getElementById("logoutBtn").onclick = async () => { await fetch("/auth/logout", {method:"POST"}); location.reload(); };
    }
  } catch {}
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
refreshUser();

document.querySelectorAll(".ticket-type").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".ticket-type").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  selectedTopic = btn.dataset.topic;
  document.getElementById("ticketTitle").textContent = selectedTopic;
}));

async function sendForm(url, payload, noticeEl) {
  const response = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
document.getElementById("whitelistForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const payload = Object.fromEntries(form.entries());
  try {
    const data = await sendForm("/api/whitelist", payload);
    showNotice(whitelistNotice, data.message);
    e.currentTarget.reset();
  } catch(err) { showNotice(whitelistNotice, err.message, true); }
});
document.getElementById("ticketForm").addEventListener("submit", async e => {
  e.preventDefault();
  const details = new FormData(e.currentTarget).get("details");
  try {
    const data = await sendForm("/api/tickets", {topic:selectedTopic, details});
    showNotice(ticketNotice, "Ticket created successfully. Opening Discord...");
    window.open(data.channelUrl, "_blank");
    e.currentTarget.reset();
  } catch(err) { showNotice(ticketNotice, err.message, true); }
});