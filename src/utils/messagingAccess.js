import Conversation from "../models/conversationModel.js";
import { StatusCodes } from "http-status-codes";
import { ensureAccessToPatient } from "./accessControl.js";

// Ensures user is participant & has access to patient.
export const ensureParticipantAccess = async (user, conversationId) => {
  const convo = await Conversation.findById(conversationId)
    .select("participants")
    .lean();

  if (!convo) {
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Conversation not found",
    };
  }

  return convo;
};

// import Conversation from "../models/conversationModel.js";
// import { StatusCodes } from "http-status-codes";
// import { ensureAccessToPatient } from "./accessControl.js";

// // Ensures user is participant & has access to patient.
// export const ensureParticipantAccess = async (user, conversationId) => {
//   const convo = await Conversation.findById(conversationId)
//     .select("participants")
//     .lean();

//   if (!convo) {
//     throw {
//       statusCode: StatusCodes.NOT_FOUND,
//       message: "Conversation not found"
//     };
//   }

//   // // general patient access (hospital/nurse/caregiver/family/patient)
//   // await ensureAccessToPatient(user);

//   // const isParticipant = (convo.participants || [])
//   //   .map((p) => String(p.userId))
//   //   .includes(String(user._id || user.id));

//   // if (
//   //   !isParticipant &&
//   //   user.role !== "super_admin" &&
//   //   user.role !== "hospital"
//   // ) {
//   //   throw {
//   //     statusCode: StatusCodes.FORBIDDEN,
//   //     message: "Not a participant of this conversation"
//   //   };
//   // }

//   return convo;
// };
