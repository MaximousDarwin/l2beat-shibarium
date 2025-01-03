import { CountedBlock, CountedOperation, CountedTransaction } from '@/types'
import { expect, mockFn, mockObject } from 'earl'
import { ContractClient } from '../clients/contract/ContractClient'
import { SignatureClient } from '../clients/signature/SignatureClient'
import { DB } from '../db/db'
import { NameService } from './NameService'

describe(NameService.name, () => {
  describe(NameService.prototype.fillNames.name, () => {
    it('should fill method and contract names', async () => {
      const mockBlock: CountedBlock = mockObject<CountedBlock>({
        transactions: [
          mockObject<CountedTransaction>({
            details: mockObject<CountedOperation>(),
          }),
          mockObject<CountedTransaction>({
            details: mockObject<CountedOperation>(),
          }),
        ],
      })

      const nameService = createNameService()

      const fillMethodNamesMock =
        mockFn<(operation: CountedOperation) => Promise<void>>().resolvesTo()
      nameService.fillMethodNames = fillMethodNamesMock

      const fillContractNamesMock =
        mockFn<(operation: CountedOperation) => Promise<void>>().resolvesTo()
      nameService.fillContractNames = fillContractNamesMock

      await nameService.fillNames(mockBlock)
      expect(fillContractNamesMock).toHaveBeenCalledTimes(2)
    })
  })

  describe(NameService.prototype.fillMethodNames.name, () => {
    it('should fill method names and save new signatures to DB', async () => {
      const mockDB: DB = {
        METHODS: new Map([['selector1', 'name1']]),
        CONTRACTS: new Map(),
      }

      const mockSignatureClient1 = mockObject<SignatureClient>({
        getSignature: mockFn().resolvesToOnce('name2'),
        getName: mockFn().returns('client1'),
      })

      const mockSignatureClient2 = mockObject<SignatureClient>({
        getSignature: mockFn().resolvesToOnce('name3'),
        getName: mockFn().returns('client2'),
      })

      const mockOperation: CountedOperation = mockObject<CountedOperation>({
        methodSelector: 'selector0',
        methodName: 'root',
        children: [
          mockObject<CountedOperation>({
            methodSelector: 'selector1',
            methodName: '',
            children: [],
          }),
          mockObject<CountedOperation>({
            methodSelector: 'selector2',
            methodName: '',
            children: [],
          }),
          mockObject<CountedOperation>({
            methodSelector: 'selector3',
            methodName: '',
            children: [],
          }),
        ],
      })

      const nameService = createNameService(mockDB, [
        mockSignatureClient1,
        mockSignatureClient2,
      ])

      await nameService.fillMethodNames(mockOperation)

      expect(mockSignatureClient1.getSignature).toHaveBeenCalledWith(
        'selector2',
      )

      expect(mockSignatureClient2.getSignature).toHaveBeenCalledWith(
        'selector3',
      )

      expect(mockDB.METHODS).toEqual(
        new Map([
          ['selector1', 'name1'],
          ['selector2', 'name2'],
          ['selector3', 'name3'],
        ]),
      )

      expect(mockOperation.children[0].methodName).toEqual('name1')
      expect(mockOperation.children[1].methodName).toEqual('name2')
      expect(mockOperation.children[2].methodName).toEqual('name3')
    })
  })

  describe(NameService.prototype.fillContractNames.name, () => {
    it('should fill contract names and save new signatures to DB', async () => {
      const mockDB: DB = {
        METHODS: new Map(),
        CONTRACTS: new Map([['address1', 'name1']]),
      }

      const mockContractClient = mockObject<ContractClient>({
        getName: mockFn().resolvesToOnce('name2'),
      })

      const mockOperation: CountedOperation = mockObject<CountedOperation>({
        contractAddress: 'address0',
        contractName: 'root',
        children: [
          mockObject<CountedOperation>({
            contractAddress: 'address1',
            contractName: '',
            children: [],
          }),
          mockObject<CountedOperation>({
            contractAddress: 'address2',
            contractName: '',
            children: [],
          }),
        ],
      })

      const nameService = createNameService(mockDB, [], mockContractClient)

      await nameService.fillContractNames(mockOperation)

      expect(mockContractClient.getName).toHaveBeenCalledWith('address2')

      expect(mockDB.CONTRACTS).toEqual(
        new Map([
          ['address1', 'name1'],
          ['address2', 'name2'],
        ]),
      )

      expect(mockOperation.children[0].contractName).toEqual('name1')
      expect(mockOperation.children[1].contractName).toEqual('name2')
    })
  })
})

function createNameService(
  db?: DB,
  signatureClients?: SignatureClient[],
  contractClient?: ContractClient,
) {
  return new NameService(
    db ?? {
      METHODS: new Map(),
      CONTRACTS: new Map(),
    },
    signatureClients ?? [],
    contractClient ?? mockObject<ContractClient>(),
  )
}
