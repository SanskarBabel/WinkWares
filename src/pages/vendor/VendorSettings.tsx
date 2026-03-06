import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase-client';
import { Upload, FileText, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

type KYCDocument = {
    id: string
    document_type: string
    file_name: string
    verification_status: string
    rejection_reason?: string
    submitted_at: string
}

type Vendor = {
    id: string
    store_name: string
    onboarding_status: string
}

export function VendorSettings() {
    const { user } = useAuth()
    const [vendor, setVendor] = useState<Vendor | null>(null)
    const [documents, setDocuments] = useState<KYCDocument[]>([])
    const [uploading, setUploading] = useState(false)
    const [processing, setProcessing] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadVendorData()
    }, [user])

    const loadVendorData = async () => {
        if (!user) return

        try {
            // Load vendor info
            const { data: vendorData, error: vendorError } = await supabase
                .from('vendors')
                .select('id, store_name, onboarding_status')
                .eq('profile_id', user.id)
                .single()

            if (vendorError) throw vendorError
            setVendor(vendorData)

            // Load KYC documents
            const { data: docsData, error: docsError } = await supabase
                .from('kyc_documents')
                .select('*')
                .eq('vendor_id', vendorData.id)
                .order('submitted_at', { ascending: false })

            if (docsError) throw docsError
            setDocuments(docsData || [])
        } catch (error) {
            console.error('Error loading vendor data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
        if (!e.target.files || !e.target.files[0] || !vendor) return

        const file = e.target.files[0]
        const fileExt = file.name.split('.').pop()
        const fileName = `${user!.id}/${Date.now()}.${fileExt}`

        setUploading(true)

        try {
            // Upload to storage
            const { error: uploadError } = await supabase.storage
                .from('kyc-documents')
                .upload(fileName, file, {
                    contentType: file.type,
                    upsert: false,
                })

            if (uploadError) throw uploadError

            // Create document record
            const { data: docData, error: docError } = await supabase
                .from('kyc_documents')
                .insert({
                    vendor_id: vendor.id,
                    document_type: docType,
                    file_path: fileName,
                    file_name: file.name,
                    file_size: file.size,
                    mime_type: file.type,
                })
                .select()
                .single()

            if (docError) throw docError

            // Trigger processing
            setProcessing(docData.id)
            await processKYCDocument(docData.id)

            // Reload data
            await loadVendorData()
        } catch (error) {
            console.error('Error uploading document:', error)
            alert('Failed to upload document. Please try again.')
        } finally {
            setUploading(false)
            setProcessing(null)
            e.target.value = ''
        }
    }

    const processKYCDocument = async (documentId: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) throw new Error('No session')

            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-kyc`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ documentId }),
                }
            )

            const result = await response.json()

            if (result.success) {
                console.log('Document processed successfully:', result)
            } else {
                console.error('Document processing failed:', result)
            }
        } catch (error) {
            console.error('Error processing document:', error)
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'verified':
                return (
                    <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-full">
                        <CheckCircle className="h-3 w-3" />
                        Verified
                    </span>
                )
            case 'pending':
                return (
                    <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-yellow-700 bg-yellow-50 rounded-full">
                        <Clock className="h-3 w-3" />
                        Pending
                    </span>
                )
            case 'rejected':
                return (
                    <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-full">
                        <XCircle className="h-3 w-3" />
                        Rejected
                    </span>
                )
            default:
                return null
        }
    }

    const getDocStatusIcon = (status: string) => {
        switch (status) {
            case 'approved':
                return <CheckCircle className="h-5 w-5 text-green-600" />
            case 'rejected':
                return <XCircle className="h-5 w-5 text-red-600" />
            case 'processing':
                return <Clock className="h-5 w-5 text-blue-600 animate-pulse" />
            default:
                return <Clock className="h-5 w-5 text-gray-400" />
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-sm text-gray-600 mt-1">Manage your vendor account and verification</p>
            </div>

            {/* Verification Status Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Verification Status</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Complete KYC verification to start selling
                        </p>
                    </div>
                    {vendor && getStatusBadge(vendor.onboarding_status)}
                </div>

                {vendor?.onboarding_status !== 'verified' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <div className="flex gap-3">
                            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-blue-900">
                                <p className="font-medium mb-1">Verification Required</p>
                                <p className="text-blue-700">
                                    Upload your business license and identity proof to get verified and start selling.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Document Upload Section */}
                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-900">Required Documents</h3>

                    {/* Business License */}
                    <div className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-gray-400" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Business License</p>
                                    <p className="text-xs text-gray-500">PDF, JPG, or PNG (Max 10MB)</p>
                                </div>
                            </div>
                            {documents.find(d => d.document_type === 'business_license') &&
                                getDocStatusIcon(documents.find(d => d.document_type === 'business_license')!.verification_status)
                            }
                        </div>

                        <label className="block">
                            <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => handleFileUpload(e, 'business_license')}
                                disabled={uploading || processing !== null}
                                className="hidden"
                            />
                            <div className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                                <Upload className="h-4 w-4" />
                                {uploading ? 'Uploading...' : 'Upload Document'}
                            </div>
                        </label>

                        {documents.find(d => d.document_type === 'business_license' && d.rejection_reason) && (
                            <p className="text-xs text-red-600 mt-2">
                                {documents.find(d => d.document_type === 'business_license')!.rejection_reason}
                            </p>
                        )}
                    </div>

                    {/* Identity Proof */}
                    <div className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-gray-400" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Identity Proof</p>
                                    <p className="text-xs text-gray-500">Government-issued ID (Max 10MB)</p>
                                </div>
                            </div>
                            {documents.find(d => d.document_type === 'identity_proof') &&
                                getDocStatusIcon(documents.find(d => d.document_type === 'identity_proof')!.verification_status)
                            }
                        </div>

                        <label className="block">
                            <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => handleFileUpload(e, 'identity_proof')}
                                disabled={uploading || processing !== null}
                                className="hidden"
                            />
                            <div className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                                <Upload className="h-4 w-4" />
                                {uploading ? 'Uploading...' : 'Upload Document'}
                            </div>
                        </label>

                        {documents.find(d => d.document_type === 'identity_proof' && d.rejection_reason) && (
                            <p className="text-xs text-red-600 mt-2">
                                {documents.find(d => d.document_type === 'identity_proof')!.rejection_reason}
                            </p>
                        )}
                    </div>
                </div>

                {/* Document History */}
                {documents.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <h3 className="text-sm font-medium text-gray-900 mb-3">Upload History</h3>
                        <div className="space-y-2">
                            {documents.map((doc) => (
                                <div key={doc.id} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        {getDocStatusIcon(doc.verification_status)}
                                        <span className="text-gray-700">{doc.file_name}</span>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                        {new Date(doc.submitted_at).toLocaleDateString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}