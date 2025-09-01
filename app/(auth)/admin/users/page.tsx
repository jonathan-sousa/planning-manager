'use client';

import { useState } from 'react';
import { AdminCreateUserCommand, AdminAddUserToGroupCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { fetchAuthSession } from 'aws-amplify/auth';
import outputs from '@/amplify_outputs.json';

export default function AdminUsersPage() {
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    group: 'USERS'
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Récupérer les credentials AWS
      const session = await fetchAuthSession();
      
      const client = new CognitoIdentityProviderClient({
        region: outputs.auth.aws_region,
        credentials: session.credentials
      });

      // Générer un mot de passe temporaire
      const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!123`;

      // Créer l'utilisateur
      const createUserCommand = new AdminCreateUserCommand({
        UserPoolId: outputs.auth.user_pool_id,
        Username: formData.email,
        UserAttributes: [
          { Name: 'email', Value: formData.email },
          { Name: 'given_name', Value: formData.firstName },
          { Name: 'family_name', Value: formData.lastName },
          { Name: 'email_verified', Value: 'true' },
          ...(formData.phone ? [{ Name: 'phone_number', Value: formData.phone }] : [])
        ],
        TemporaryPassword: tempPassword,
        MessageAction: 'SUPPRESS'
      });

      await client.send(createUserCommand);

      // Ajouter au groupe
      const addToGroupCommand = new AdminAddUserToGroupCommand({
        UserPoolId: outputs.auth.user_pool_id,
        Username: formData.email,
        GroupName: formData.group
      });

      await client.send(addToGroupCommand);

      setMessage(`Utilisateur créé avec succès ! Mot de passe temporaire : ${tempPassword}`);
      
      // Réinitialiser le formulaire
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        phone: '',
        group: 'USERS'
      });
    } catch (error) {
      console.error('Erreur:', error);
      setMessage(`Erreur : ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Gestion des utilisateurs</h2>
        <p className="mt-1 text-sm text-gray-600">
          Créez de nouveaux utilisateurs et assignez-les à des groupes
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Prénom *
              </label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Nom *
              </label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Téléphone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              placeholder="+33612345678"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Groupe *
            </label>
            <select
              value={formData.group}
              onChange={(e) => setFormData({...formData, group: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="USERS">Utilisateur</option>
              <option value="ADMINS">Administrateur</option>
            </select>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Création...' : 'Créer l\'utilisateur'}
            </button>
          </div>
        </form>

        {message && (
          <div className={`mt-4 p-4 rounded-md ${message.includes('Erreur') ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
            <p className="whitespace-pre-wrap">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}