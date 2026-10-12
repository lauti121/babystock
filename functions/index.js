const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

const textPreview = (value, max = 110) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
const isInvalidToken = (error) => ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(error?.code);

async function sendToFamily({ familyId, senderId, title, body }) {
  const devices = await db.collection("families").doc(familyId).collection("devices").where("enabled", "==", true).get();
  const recipients = devices.docs.filter((document) => document.data().userId !== senderId && document.data().token);
  if (!recipients.length) return null;

  const response = await getMessaging().sendEachForMulticast({
    tokens: recipients.map((document) => document.data().token),
    webpush: { fcmOptions: { link: "https://babystock.pages.dev/" } },
    data: { familyId, destination: "family", title, body }
  });

  await Promise.all(response.responses.map((result, index) => isInvalidToken(result.error) ? recipients[index].ref.delete() : null));
  logger.info("Notificación familiar procesada", { familyId, sent: response.successCount, failed: response.failureCount });
  return response;
}

exports.notifyFamilyPost = onDocumentCreated("families/{familyId}/familyPosts/{postId}", async (event) => {
  const post = event.data?.data();
  if (!post) return null;
  const labels = { nota: "Nueva nota familiar", compra: "Pendiente de compra", recuerdo: "Nuevo recuerdo" };
  return sendToFamily({
    familyId: event.params.familyId,
    senderId: post.actorId,
    title: `BabyStock · ${labels[post.type] || "Actualización familiar"}`,
    body: textPreview(post.text) || "Tienes una actualización de tu familia."
  });
});
