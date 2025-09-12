import PrescriptionRequest from "../models/prescriptionRequestModel.js";
import SystemLog from "../models/systemLogModel.js";

// Stubbed search: replace with real vendor API
export const searchMeds = async ({ q, page = 1, limit = 10 }) => {
  const sample = [
    { drugName: "Acetaminophen 500mg", form: "tablet" },
    { drugName: "Ibuprofen 200mg", form: "tablet" },
    { drugName: "Metformin 500mg", form: "tablet" }
  ].filter((x) => x.drugName.toLowerCase().includes(q.toLowerCase()));
  const start = (page - 1) * limit;
  const items = sample.slice(start, start + limit);
  return {
    results: items,
    pagination: {
      total: sample.length,
      page,
      limit,
      totalPages: Math.ceil(sample.length / limit)
    }
  };
};

export const createPrescriptionOrder = async (payload, requestedBy) => {
  const doc = await PrescriptionRequest.create([{ ...payload, requestedBy }]);
  await SystemLog.create({
    action: "pharmacy_order_created",
    entityType: "PrescriptionRequest",
    entityId: doc[0]._id,
    performedBy: requestedBy
  });
  // TODO: call external vendor → update status/vendorOrderId
  return doc[0].toObject();
};

export const getOrderById = async (id) => {
  const rx = await PrescriptionRequest.findById(id)
    .populate("requestedBy", "firstName lastName role")
    .lean();
  if (!rx) throw { statusCode: 404, message: "Prescription order not found" };
  return { order: rx };
};
