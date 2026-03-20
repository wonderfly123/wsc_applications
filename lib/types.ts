export interface BEOData {
  clientFirstName: string
  clientLastName: string
  companyName: string
  clientEmail: string
  clientPhone: string
  eventType: string
  serviceStart: string
  serviceEnd: string
  eventLocation: string
  package: string
  coconutQty: string
  readyBy: string
  garnish: string
  setupProvided: string
  stampStatus: string
  certsNeeded: string
  loadInLocation: string
  deliveryInstructions: string
  eventNotes: string
}

export const FIELD_MAP: Record<keyof BEOData, string> = {
  clientFirstName: '6448e40e-5c59-4aeb-b99a-5755536b9463',
  clientLastName: '7ec644ea-814a-4a79-ab52-4a4543466cfb',
  companyName: '75e86982-b682-4c56-86c4-2007b87d89df',
  clientEmail: 'a4316b37-4646-4db8-93d7-c37561d17a77',
  clientPhone: '2d0cc4d7-91e9-4d8d-bc0e-43321cfa1d48',
  eventType: 'afb623cf-472e-4d03-b220-bf3b3ce11bc6',
  serviceStart: 'f6483054-1434-4c04-ac53-06af6042a96f',
  serviceEnd: 'c4bcdf67-b72d-4531-953e-5cb542b14a3e',
  eventLocation: 'b92b1e46-363e-4453-9888-b530ecdeefce',
  package: '72edb0f2-022a-4db4-8ec4-88d694cd54b0',
  coconutQty: '3e9943e1-4e51-466b-9d6d-f01e862a1bec',
  readyBy: '54389f19-e059-4418-b842-1b1cd12539ca',
  garnish: 'b9341990-5265-41a1-ba1e-4cbd3c767084',
  setupProvided: '87c25b9c-21b0-4420-8ad9-3d36265d567b',
  stampStatus: '843a7dd5-b277-4429-8240-78515c297a05',
  certsNeeded: 'f459ee0d-aa89-4d9e-aeff-bf714b7728d6',
  loadInLocation: '967038c5-4d18-41d5-8c63-f01bf20ece7a',
  deliveryInstructions: 'b4457a6a-5d84-4505-9e9b-6883303331b3',
  eventNotes: 'd4ac6c86-d0d6-48e2-8958-b0ede74e3456',
}
