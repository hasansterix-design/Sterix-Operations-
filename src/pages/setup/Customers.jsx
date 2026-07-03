import PartyManager from './PartyManager'

export default function Customers() {
  return (
    <PartyManager
      table="customers"
      moduleId="customers"
      title="Customers"
      description="Customer master list used in the Dispatch Register."
      hasContactPerson={false}
    />
  )
}
